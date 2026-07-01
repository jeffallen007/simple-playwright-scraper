# Google Play Review Scraper

A simple Playwright-based scraper for extracting Google Play app reviews into a CSV file.

The scraper opens a Google Play app page, navigates to the full reviews modal, sorts reviews by **Newest**, scrolls through the review list, and extracts a configurable number of reviews.

## Extracted Fields

The output CSV includes:

* `username`
* `star_rating`
* `date`
* `review_text`

## Requirements

* Node.js
* npm
* Playwright

## Install / Setup

Clone or create the project folder:

```bash
mkdir simple-playwright-scraper
cd simple-playwright-scraper
```

Initialize a Node project:

```bash
npm init -y
```

Install Playwright:

```bash
npm install playwright
```

Install the browser binaries used by Playwright:

```bash
npx playwright install
```

Add the scraper code to a file named:

```bash
scrape.js
```

## Run the Scraper

Basic usage:

```bash
node scrape.js "<GOOGLE_PLAY_APP_URL>" <NUMBER_OF_REVIEWS>
```

Example:

```bash
node scrape.js "https://play.google.com/store/apps/details?id=com.strava&hl=en_US" 300
```

This will:

1. Open the Google Play app page
2. Navigate to **Ratings and reviews**
3. Open the reviews popup
4. Sort reviews by **Newest**
5. Scroll through reviews
6. Extract up to 300 reviews
7. Save the results to a CSV file

## Default Run

You can also run the script without arguments:

```bash
node scrape.js
```

By default, it will scrape 300 reviews from the Strava Google Play listing:

```text
https://play.google.com/store/apps/details?id=com.strava&hl=en_US
```

## Output

The scraper creates a CSV file in the project root.

The filename is based on the Google Play app ID.

Example:

```text
com.strava_google_play_reviews.csv
```

## Example Output Columns

```csv
username,star_rating,date,review_text
```

## Running Against Another App

Find the app’s Google Play URL and pass it as the first argument.

Example:

```bash
node scrape.js "https://play.google.com/store/apps/details?id=com.peloton&hl=en_US" 500
```

This will attempt to scrape the 500 newest reviews for the Peloton app.

## Notes

Google Play uses dynamic markup and may change its page structure over time. If the scraper suddenly stops working, the most likely cause is that one or more page selectors need to be updated.

While developing or debugging, the scraper runs with:

```js
headless: false
```

This means a browser window will open so you can watch the scraper navigate the page. Once the scraper is stable, you can change this to:

```js
headless: true
```

to run it in the background.

## Troubleshooting

### Browser opens but nothing happens

The scraper may be unable to find the expected button or page element. Check the terminal output for a selector or timeout error.

### Scraper opens the reviews modal but fails on sorting

Google Play may have changed the dropdown markup. Inspect the page using:

```bash
npx playwright codegen "https://play.google.com/store/apps/details?id=com.strava&hl=en_US"
```

Then update the relevant selector in `scrape.js`.

### CSV has fewer reviews than requested

This can happen if:

* Google Play does not load enough reviews
* The scraper reaches the end of the available review list
* The page stops loading more reviews while scrolling
* Duplicate reviews are skipped

## Project Structure

Recommended simple structure:

```text
simple-playwright-scraper/
  scrape.js
  README.md
  package.json
  package-lock.json
  com.strava_google_play_reviews.csv
```

## Important Usage Note

Use this responsibly. Avoid excessive scraping, respect website terms, and do not overload Google Play or any other site.
