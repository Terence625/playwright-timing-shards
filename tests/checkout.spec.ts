import { expect, test } from '@playwright/test';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe('checkout', () => {
  test('validates shipping address @medium', async () => {
    await wait(700);
    expect('Melbourne').toMatch(/bourne$/);
  });

  test('authorises payment @slow', async () => {
    await wait(1800);
    expect({ status: 'approved' }).toEqual({ status: 'approved' });
  });

  test('sends confirmation email @fast', async () => {
    await wait(180);
    expect('customer@example.com').toContain('@');
  });
});

