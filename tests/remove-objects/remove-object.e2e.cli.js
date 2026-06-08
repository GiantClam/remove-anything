async (page) => {
  const pageUrl = __PAGE_URL__;
  const sourceImage = __SOURCE_IMAGE__;
  const downloadDir = __DOWNLOAD_DIR__;
  const screenshotDir = __SCREENSHOT_DIR__;
  const now = new Date().toISOString().replace(/[:.]/g, "-");

  let taskId = "";
  page.on("response", async (response) => {
    if (
      response.url().includes("/api/remove-objects") &&
      response.request().method() === "POST"
    ) {
      try {
        const payload = await response.json();
        if (typeof payload?.taskId === "string") {
          taskId = payload.taskId;
        }
      } catch {
        // ignore non-json responses
      }
    }
  });

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached", timeout: 120_000 });
  await fileInput.setInputFiles(sourceImage);

  const uploadStatus = page.getByText(/Uploading your image/i);
  await uploadStatus.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});

  await page.waitForFunction(() => {
    const sourceCanvas = document.querySelector('canvas[aria-label="Source image"]');
    return Boolean(
      sourceCanvas &&
        sourceCanvas.width > 0 &&
        sourceCanvas.height > 0,
    );
  }, { timeout: 120_000 });

  const canvas = page.locator('canvas[aria-label="Editable mask"]');
  await canvas.waitFor({ state: "visible", timeout: 120_000 });

  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error("Editable mask canvas is not visible.");
  }

  const start = {
    x: canvasBox.x + canvasBox.width * 0.46,
    y: canvasBox.y + canvasBox.height * 0.10,
  };
  const end = {
    x: canvasBox.x + canvasBox.width * 0.86,
    y: canvasBox.y + canvasBox.height * 0.80,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 18 });
  await page.mouse.up();

  await page.screenshot({
    path: `${screenshotDir}/${now}-after-box.png`,
    fullPage: true,
  });

  const removeButton = page.getByRole("button", { name: /移除物件/i });
  await removeButton.waitFor({ state: "visible", timeout: 15_000 });
  await removeButton.click();

  const downloadButton = page.getByRole("button", { name: /下載結果/i }).first();
  await downloadButton.waitFor({ state: "visible", timeout: 8 * 60 * 1000 });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    downloadButton.click(),
  ]);

  const suggestedFilename =
    download.suggestedFilename() || `remove-object-${Date.now()}.png`;
  const outputPath = `${downloadDir}/${Date.now()}-${suggestedFilename}`;
  await download.saveAs(outputPath);

  await page.screenshot({
    path: `${screenshotDir}/${now}-success.png`,
    fullPage: true,
  });

  console.log(`E2E_TASK_ID=${taskId || "unknown"}`);
  console.log(`E2E_OUTPUT_PATH=${outputPath}`);
}
