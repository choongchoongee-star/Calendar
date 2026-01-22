# Monthly Schedule Service

A simple, responsive, and modern web-based monthly schedule service built with only HTML, CSS, and JavaScript. This project provides a full-month calendar view where users can add and delete schedule items. All data is saved to the browser's localStorage, so your schedules persist after a page refresh.

## Features

- **Full Month View:** See all days of the current month in a grid layout.
- **Schedule Management:** Add and delete schedule items for any day.
- **Data Persistence:** Schedules are saved in `localStorage` and are available even after closing the browser.
- **Responsive Design:** The layout works on both desktop and mobile devices.
- **Modern UI:** Clean and minimal design for a great user experience.
- **Easy Navigation:** Navigate to the previous and next months.
- **No Dependencies:** Built with vanilla HTML, CSS, and JavaScript. No frameworks or external libraries are required.

## How to Run Locally

Since this is a simple static website, you don't need any complex setup. Just follow these steps:

1.  **Clone the repository or download the source code.**
2.  **Navigate to the project directory.**
3.  **Open the `index.html` file in your web browser.**

That's it! The monthly schedule service should now be running in your browser.

## How to Deploy

This project can be deployed as a static website to any hosting service that supports static files. Here are instructions for deploying to GitHub Pages, a popular and free option:

1.  **Create a new repository on GitHub.**
2.  **Push the project files (`index.html`, `style.css`, `script.js`) to your new repository.**
3.  **In your GitHub repository, go to `Settings` > `Pages`.**
4.  **Under the "Branch" section, select the branch you want to deploy from (usually `main` or `master`).**
5.  **Click `Save`.**

GitHub will then build and deploy your website. It will be available at a URL like `https://<your-username>.github.io/<your-repository-name>/`.

## Project Structure

-   `index.html`: The main HTML file containing the structure of the calendar and the modal for adding schedules.
-   `style.css`: The CSS file for styling the application, including the responsive design.
-   `script.js`: The JavaScript file that contains all the logic for rendering the calendar, managing schedules, and interacting with `localStorage`.

## Code Overview

### HTML (`index.html`)

-   The basic structure includes a header for the month and navigation, a container for the calendar grid, and a modal for adding schedules.
-   The calendar grid and days are generated dynamically with JavaScript.

### CSS (`style.css`)

-   Uses CSS Grid for the calendar layout, ensuring a responsive design.
-   Flexbox is used for alignment and layout of smaller components.
-   The current day is highlighted with a different background color.
-   The modal for adding schedules is styled to appear as an overlay.

### JavaScript (`script.js`)

-   The script is wrapped in a `DOMContentLoaded` event listener to ensure the DOM is fully loaded before the script runs.
-   `currentDate`: A `Date` object that keeps track of the month and year being displayed.
-   `schedules`: An object that stores all schedule items, with keys in the format `YYYY-M-D`.
-   `renderCalendar()`: The core function that generates the calendar grid for the current month, including blank days and days with schedules.
-   **Schedule Management:**
    -   `openAddScheduleModal()`: Shows the modal for adding a new schedule.
    -   `saveSchedule()`: Saves a new schedule to the `schedules` object and updates `localStorage`.
    -   `deleteSchedule()`: Removes a schedule and updates `localStorage`.
-   **Local Storage:**
    -   `saveSchedulesToLocalStorage()`: Serializes the `schedules` object and saves it to `localStorage`.
    -   Schedules are loaded from `localStorage` when the page first loads.
-   **Event Listeners:**
    -   Click events for the next/previous month buttons.
    -   Click events on each day to open the "Add Schedule" modal.
    -   Click events for saving and deleting schedules.
