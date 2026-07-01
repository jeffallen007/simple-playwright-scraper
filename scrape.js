const { chromium } = require("playwright");
const fs = require("fs");

const DEFAULT_URL =
  "https://play.google.com/store/apps/details?id=com.strava&hl=en_US";

const DEFAULT_MAX_REVIEWS = 300;

const targetUrl = process.argv[2] || DEFAULT_URL;
const maxReviews = Number.parseInt(process.argv[3] || DEFAULT_MAX_REVIEWS, 10);

if (!targetUrl.startsWith("http")) {
  console.error("Error: First argument must be a valid URL.");
  console.error(
    'Example: node scrape.js "https://play.google.com/store/apps/details?id=com.strava&hl=en_US" 300'
  );
  process.exit(1);
}

if (!Number.isInteger(maxReviews) || maxReviews <= 0) {
  console.error("Error: Second argument must be a positive integer.");
  console.error(
    'Example: node scrape.js "https://play.google.com/store/apps/details?id=com.strava&hl=en_US" 300'
  );
  process.exit(1);
}

const appIdMatch = targetUrl.match(/[?&]id=([^&]+)/);
const appId = appIdMatch
  ? appIdMatch[1].replace(/[^a-zA-Z0-9._-]/g, "_")
  : "app";

const OUTPUT_FILE = `${appId}_google_play_reviews.csv`;

function escapeCsv(value) {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function saveToCsv(rows, filePath) {
  const headers = ["username", "star_rating", "date", "review_text"];

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsv(row[header])).join(",")
    ),
  ].join("\n");

  fs.writeFileSync(filePath, csv, "utf8");
}

async function acceptCookiesIfNeeded(page) {
  const possibleButtons = [
    /accept all/i,
    /reject all/i,
    /i agree/i,
    /agree/i,
  ];

  for (const label of possibleButtons) {
    const button = page.getByRole("button", { name: label }).first();

    if (await button.isVisible().catch(() => false)) {
      await button.click();
      await page.waitForTimeout(1000);
      return;
    }
  }
}

async function openReviewsModal(page) {
  await page
    .getByText("Ratings and reviews", { exact: true })
    .scrollIntoViewIfNeeded();

  await page.waitForTimeout(1000);

  const buttonsAfterHeading = page.locator(
    'xpath=//*[normalize-space()="Ratings and reviews"]/following::button'
  );

  const count = await buttonsAfterHeading.count();

  for (let i = 0; i < Math.min(count, 25); i++) {
    const button = buttonsAfterHeading.nth(i);

    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 5000 });
      await page.locator('div[role="dialog"]').waitFor({ timeout: 10000 });
      return;
    }
  }

  throw new Error("Could not find a visible button to open the reviews modal.");
}

async function sortByNewest(page) {
  const dialog = page.locator('div[role="dialog"]').last();

  const sortButton = dialog
    .getByRole("button", { name: /most relevant/i })
    .first();

  await sortButton.click({ timeout: 10000 });
  await page.waitForTimeout(500);

  const newestOption = page.getByRole("option", { name: /^Newest$/ }).first();

  if (await newestOption.isVisible().catch(() => false)) {
    await newestOption.click({ timeout: 10000 });
  } else {
    await page.getByText(/^Newest$/).first().click({ timeout: 10000 });
  }

  await page.waitForTimeout(1500);
}

async function expandVisibleReviews(page) {
  const buttons = page.getByRole("button", { name: /full review/i });
  const count = await buttons.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);

    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
      await page.waitForTimeout(100);
    }
  }
}

async function extractVisibleReviews(page) {
  const dialog = page.locator('div[role="dialog"]').last();

  return await dialog.locator("div.RHo1pe").evaluateAll((cards) => {
    function clean(value) {
      return (value || "").replace(/\s+/g, " ").trim();
    }

    function parseRating(card) {
      const ratingEl = card.querySelector('[role="img"][aria-label*="star"]');
      const label = ratingEl?.getAttribute("aria-label") || "";
      const match = label.match(/(\d+)\s+star/i);
      return match ? Number(match[1]) : null;
    }

    return cards
      .map((card) => {
        const username = clean(card.querySelector(".X5PpBb")?.textContent);
        const date = clean(card.querySelector(".bp9Aid")?.textContent);
        const reviewText = clean(card.querySelector(".h3YV2d")?.textContent);
        const starRating = parseRating(card);

        return {
          username,
          star_rating: starRating,
          date,
          review_text: reviewText,
        };
      })
      .filter((review) => review.username && review.review_text);
  });
}

async function scrollReviews(page) {
  const dialog = page.locator('div[role="dialog"]').last();

  await dialog.hover();
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(1000);
}

async function scrape() {
  console.log(`Scraping URL: ${targetUrl}`);
  console.log(`Review limit: ${maxReviews}`);
  console.log(`Output file: ${OUTPUT_FILE}`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
  });

  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 1000,
    },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  });

  const reviews = [];
  const seen = new Set();

  try {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await acceptCookiesIfNeeded(page);
    await openReviewsModal(page);
    await sortByNewest(page);

    let previousCount = 0;
    let stalledScrolls = 0;

    while (reviews.length < maxReviews && stalledScrolls < 5) {
      await expandVisibleReviews(page);

      const visibleReviews = await extractVisibleReviews(page);

      for (const review of visibleReviews) {
        const key = `${review.username}|${review.date}|${review.review_text}`;

        if (!seen.has(key)) {
          seen.add(key);
          reviews.push(review);
        }

        if (reviews.length >= maxReviews) {
          break;
        }
      }

      console.log(`Collected ${reviews.length} reviews...`);

      if (reviews.length === previousCount) {
        stalledScrolls++;
      } else {
        stalledScrolls = 0;
        previousCount = reviews.length;
      }

      if (reviews.length < maxReviews) {
        await scrollReviews(page);
      }
    }

    const finalReviews = reviews.slice(0, maxReviews);
    saveToCsv(finalReviews, OUTPUT_FILE);

    console.log(`Done. Saved ${finalReviews.length} reviews to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("Scrape failed:", error);
  } finally {
    await browser.close();
  }
}

scrape();
