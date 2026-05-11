import { expect, test } from '@playwright/test';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const checkoutScenarios = [
  { title: 'validates shipping address', duration: 700, tag: 'short' },
  { title: 'authorises saved payment method', duration: 620, tag: 'short' },
  { title: 'quotes standard shipping', duration: 540, tag: 'short' },
  { title: 'sends confirmation email', duration: 460, tag: 'short' },
  { title: 'records tax invoice details', duration: 380, tag: 'short' },
  { title: 'creates fulfilment request', duration: 300, tag: 'short' },
  { title: 'shows checkout summary', duration: 240, tag: 'fast' },
  { title: 'accepts marketing opt-in', duration: 210, tag: 'fast' },
  { title: 'formats card expiry', duration: 180, tag: 'fast' },
  { title: 'remembers billing country', duration: 150, tag: 'fast' },
  { title: 'displays accepted payment logos', duration: 120, tag: 'fast' },
  { title: 'keeps terms checkbox state', duration: 90, tag: 'fast' },
] as const;

test.describe('checkout', () => {
  for (const scenario of checkoutScenarios) {
    test(`${scenario.title} @${scenario.tag}`, async () => {
      await wait(scenario.duration);
      expect(scenario.duration).toBeGreaterThan(0);
    });
  }
});
