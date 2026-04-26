import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('verify logistics dashboard with 16 metrics', async ({ page }) => {
  const filePath = 'file://' + path.resolve('index.html');
  const baseJsonPath = path.resolve('base.json');

  // Mock Plotly to avoid network issues and speed up
  await page.addInitScript(() => {
    window.Plotly = {
      newPlot: (id, data, layout) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<div class="mock-chart">Mock Chart: ${id}</div>`;
        return Promise.resolve();
      }
    };
  });

  await page.goto(filePath);

  // Upload base.json
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('label[for="file-upload"]');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(baseJsonPath);

  // Wait for dashboard to appear
  await page.waitForSelector('#dashboard-content', { state: 'visible' });

  // Check KPIs
  const kpis = [
    '#kpi-total-tonnage',
    '#kpi-total-envois',
    '#kpi-avg-tonnage',
    '#kpi-active-trucks',
    '#kpi-avg-interval'
  ];
  for (const selector of kpis) {
    const text = await page.innerText(selector);
    console.log(`KPI ${selector}: ${text}`);
    expect(text).not.toBe('0');
  }

  // Check 15 Charts (one is KPI trend)
  const charts = [
    'chart-tonnage-time',
    'chart-agency-share',
    'chart-product-breakdown',
    'chart-stock-tonnage',
    'chart-top-trucks',
    'chart-vessel-tonnage',
    'chart-hourly-activity',
    'chart-calendar-heatmap',
    'chart-load-distribution',
    'chart-agency-product-matrix',
    'chart-truck-utilization',
    'chart-load-efficiency-time',
    'chart-vessel-timeline',
    'chart-low-activity-trucks',
    'chart-inter-truck-interval-time'
  ];

  for (const id of charts) {
    const el = await page.$(`#${id}`);
    expect(el).not.toBeNull();
    const content = await page.innerText(`#${id}`);
    expect(content).toContain(`Mock Chart: ${id}`);
  }

  // Check Synthesis
  const synIds = ['#syn-exec', '#syn-agencies', '#syn-stocks', '#syn-trucks', '#syn-low-activity'];
  for (const id of synIds) {
    const text = await page.innerText(id);
    console.log(`Synthesis ${id}: ${text}`);
    expect(text.length).toBeGreaterThan(0);
  }

  await page.screenshot({ path: '/home/jules/verification/full_dashboard.png', fullPage: true });
});
