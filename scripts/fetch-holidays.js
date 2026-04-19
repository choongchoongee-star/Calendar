#!/usr/bin/env node
/**
 * Fetches Korean public holidays from data.go.kr 특일정보 API and regenerates
 * the HOLIDAYS:START/END blocks in docs/script.js and
 * ios/App/App/WidgetSource/CalendarWidget.swift.
 *
 * Usage:
 *   DATA_GO_KR_API_KEY=<key> node scripts/fetch-holidays.js [startYear] [endYear]
 *
 * Defaults: fetches 5 years from current year through currentYear + 4.
 * The API requires a decoded service key; pass it URL-encoded via env var.
 *
 * Note: 설날/추석/부처님오신날/석가탄신일 are all returned by the API based on
 * the lunar calendar. 대체공휴일 are exposed as separate entries with
 * "대체공휴일" names — we keep them as-is.
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
const ROOT = path.resolve(__dirname, '..');
const JS_FILE = path.join(ROOT, 'docs', 'script.js');
const SWIFT_FILE = path.join(ROOT, 'ios', 'App', 'App', 'WidgetSource', 'CalendarWidget.swift');

const MARK_START = 'HOLIDAYS:START';
const MARK_END = 'HOLIDAYS:END';

function parseArgs() {
    const now = new Date();
    const thisYear = now.getFullYear();
    const startYear = parseInt(process.argv[2], 10) || thisYear;
    const endYear = parseInt(process.argv[3], 10) || (thisYear + 4);
    if (endYear < startYear) {
        throw new Error(`endYear (${endYear}) must be >= startYear (${startYear})`);
    }
    return { startYear, endYear };
}

async function fetchYear(year, key) {
    const results = [];
    for (let month = 1; month <= 12; month++) {
        const mm = String(month).padStart(2, '0');
        const url = `${API_BASE}?serviceKey=${encodeURIComponent(key)}&solYear=${year}&solMonth=${mm}&numOfRows=50&_type=json`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`data.go.kr ${year}-${mm} failed: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        const items = json?.response?.body?.items?.item;
        if (!items) continue;
        const list = Array.isArray(items) ? items : [items];
        for (const it of list) {
            if (it.isHoliday !== 'Y') continue;
            results.push({ date: String(it.locdate), name: it.dateName });
        }
    }
    return results;
}

function toIsoDate(yyyymmdd) {
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function addDays(isoDate, n) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

function groupConsecutive(items) {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
    const groups = [];
    for (const it of sorted) {
        const iso = toIsoDate(it.date);
        const last = groups[groups.length - 1];
        if (last && last.name === it.name && addDays(last.endDate, 1) === iso) {
            last.endDate = iso;
        } else {
            groups.push({ name: it.name, startDate: iso, endDate: iso });
        }
    }
    return groups;
}

function shortId(year, idx) {
    const yy = String(year).slice(-2);
    return `h${yy}-${idx}`;
}

function renderJs(byYear) {
    const out = [];
    out.push('            // HOLIDAYS:START (auto-generated; edit via scripts/fetch-holidays.js)');
    for (const year of Object.keys(byYear).sort()) {
        out.push(`            // ${year}`);
        byYear[year].forEach((g, i) => {
            const id = shortId(year, i + 1);
            out.push(
                `            {id: '${id}', text: ${JSON.stringify(g.name)}, startDate: '${g.startDate}', endDate: '${g.endDate}', type: 'holiday'},`
            );
        });
    }
    out.push('            // HOLIDAYS:END');
    return out.join('\n');
}

function renderSwift(byYear) {
    const out = [];
    out.push('        // HOLIDAYS:START (auto-generated; edit via scripts/fetch-holidays.js)');
    const years = Object.keys(byYear).sort();
    years.forEach((year, yi) => {
        out.push(`        // ${year}`);
        const groups = byYear[year];
        groups.forEach((g, i) => {
            const isLastYear = yi === years.length - 1;
            const isLastEntry = i === groups.length - 1;
            const trailing = isLastYear && isLastEntry ? '' : ',';
            out.push(`        ("${g.startDate}", "${g.endDate}", "${g.name}")${trailing}`);
        });
    });
    out.push('        // HOLIDAYS:END');
    return out.join('\n');
}

function replaceBlock(content, newBlock) {
    const startIdx = content.indexOf(MARK_START);
    const endIdx = content.indexOf(MARK_END);
    if (startIdx === -1 || endIdx === -1) {
        throw new Error('HOLIDAYS:START / HOLIDAYS:END markers not found');
    }
    const lineStart = content.lastIndexOf('\n', startIdx) + 1;
    const lineEnd = content.indexOf('\n', endIdx);
    const before = content.slice(0, lineStart);
    const after = content.slice(lineEnd === -1 ? content.length : lineEnd);
    return before + newBlock + after;
}

async function main() {
    const key = process.env.DATA_GO_KR_API_KEY;
    if (!key) {
        console.error('ERROR: DATA_GO_KR_API_KEY environment variable is required.');
        console.error('Request one at https://www.data.go.kr/data/15012690/openapi.do');
        process.exit(1);
    }

    const { startYear, endYear } = parseArgs();
    console.log(`Fetching holidays for ${startYear}-${endYear}...`);

    const byYear = {};
    for (let y = startYear; y <= endYear; y++) {
        const raw = await fetchYear(y, key);
        byYear[String(y)] = groupConsecutive(raw);
        console.log(`  ${y}: ${raw.length} days -> ${byYear[String(y)].length} groups`);
    }

    const jsBlock = renderJs(byYear);
    const swiftBlock = renderSwift(byYear);

    const jsBefore = fs.readFileSync(JS_FILE, 'utf8');
    const swiftBefore = fs.readFileSync(SWIFT_FILE, 'utf8');

    fs.writeFileSync(JS_FILE, replaceBlock(jsBefore, jsBlock), 'utf8');
    fs.writeFileSync(SWIFT_FILE, replaceBlock(swiftBefore, swiftBlock), 'utf8');

    console.log(`Updated ${path.relative(ROOT, JS_FILE)}`);
    console.log(`Updated ${path.relative(ROOT, SWIFT_FILE)}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
