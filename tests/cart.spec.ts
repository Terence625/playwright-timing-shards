import { expect, test } from '@playwright/test';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe('cart', () => {
  test('adds an item @fast', async () => {
    await wait(120);
    expect(1 + 1).toBe(2);
  });

  test('updates item quantity @medium', async () => {
    await wait(650);
    expect(['small', 'medium', 'large']).toContain('medium');
  });

  test('calculates discounts @slow', async () => {
    await wait(1400);
    expect(100 - 25).toBe(75);
  });
});

