import { expect, test } from '@playwright/test';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const cartScenarios = [
  { title: 'rebuilds a saved cart with 100 line items', duration: 4800, tag: 'slow' },
  { title: 'reprices an order after bulk promotion changes', duration: 4400, tag: 'slow' },
  { title: 'validates inventory across multiple warehouses', duration: 4000, tag: 'slow' },
  { title: 'applies loyalty pricing to a large basket', duration: 3600, tag: 'slow' },
  { title: 'normalises imported product options', duration: 3200, tag: 'slow' },
  { title: 'checks restricted delivery combinations', duration: 2800, tag: 'slow' },
  { title: 'adds an item to a fresh cart', duration: 1500, tag: 'medium' },
  { title: 'updates item quantity', duration: 1400, tag: 'medium' },
  { title: 'removes a discontinued item', duration: 1300, tag: 'medium' },
  { title: 'calculates tiered discounts', duration: 1200, tag: 'medium' },
  { title: 'stores a gift message', duration: 1100, tag: 'medium' },
  { title: 'persists preferred delivery window', duration: 1000, tag: 'medium' },
] as const;

test.describe('cart', () => {
  for (const scenario of cartScenarios) {
    test(`${scenario.title} @${scenario.tag}`, async () => {
      await wait(scenario.duration);
      expect(scenario.duration).toBeGreaterThan(0);
    });
  }
});
