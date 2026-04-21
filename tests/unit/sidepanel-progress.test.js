/**
 * Unit tests for sidepanel progress-bar helpers: computeExactPercentage,
 * formatFillWidth, formatDisplayPercent.
 *
 * Covers the fix for #50 — sub-percent bar resolution, minimum visible
 * width, and text that stays in sync with the non-empty bar.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const chromeMock = require('../mocks/chrome-mock');

describe('sidepanel progress helpers', () => {
  let helpers;

  beforeAll(() => {
    const htmlPath = path.join(__dirname, '../../sidepanel/sidepanel.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const dom = new JSDOM(htmlContent, {
      url: 'chrome-extension://test/sidepanel/sidepanel.html'
    });
    global.document = dom.window.document;
    global.window = dom.window;
    global.chrome = {
      ...chromeMock,
      tabs: {
        ...chromeMock.tabs,
        onUpdated: { addListener: jest.fn(), removeListener: jest.fn() }
      }
    };

    jest.isolateModules(() => {
      helpers = require('../../sidepanel/sidepanel.js');
    });
  });

  describe('computeExactPercentage', () => {
    test('returns 0 for empty/missing stats', () => {
      expect(helpers.computeExactPercentage(null)).toBe(0);
      expect(helpers.computeExactPercentage({})).toBe(0);
      expect(helpers.computeExactPercentage({ total: 0, completed: 0 })).toBe(0);
    });

    test('returns completed/total*100 when no active job', () => {
      const pct = helpers.computeExactPercentage({ completed: 1, total: 697, active: 0 });
      expect(pct).toBeCloseTo(100 / 697, 6);
    });

    test('adds in-flight byte fraction when job is active', () => {
      const pct = helpers.computeExactPercentage({
        completed: 1, total: 697, active: 1, currentJobPercent: 50
      });
      // base 1/697 + partial 0.5/697 = 1.5/697
      expect(pct).toBeCloseTo((1.5 / 697) * 100, 6);
    });

    test('skips in-flight when active is 0', () => {
      const pct = helpers.computeExactPercentage({
        completed: 1, total: 697, active: 0, currentJobPercent: 50
      });
      expect(pct).toBeCloseTo((1 / 697) * 100, 6);
    });

    test('skips in-flight when currentJobPercent is not a number', () => {
      const pct = helpers.computeExactPercentage({
        completed: 1, total: 697, active: 1
      });
      expect(pct).toBeCloseTo((1 / 697) * 100, 6);
    });

    test('caps at 100% when base+inFlight would exceed 1', () => {
      const pct = helpers.computeExactPercentage({
        completed: 697, total: 697, active: 1, currentJobPercent: 99
      });
      expect(pct).toBe(100);
    });

    test('handles restore-path stats without active/currentJobPercent', () => {
      // loadInitialState passes the GET_EXTENSION_STATUS payload which omits
      // both fields. Must fall back to base fraction without error.
      const pct = helpers.computeExactPercentage({ completed: 6, total: 697 });
      expect(pct).toBeCloseTo((6 / 697) * 100, 6);
    });
  });

  describe('formatFillWidth', () => {
    test('returns 0% for non-positive percentages', () => {
      expect(helpers.formatFillWidth(0)).toBe('0%');
      expect(helpers.formatFillWidth(-0.1)).toBe('0%');
    });

    test('clamps small nonzero percentages to a 10px minimum', () => {
      expect(helpers.formatFillWidth(0.14)).toBe('max(10px, 0.14%)');
      expect(helpers.formatFillWidth(1.5)).toBe('max(10px, 1.50%)');
    });

    test('uses the exact percentage at higher values', () => {
      expect(helpers.formatFillWidth(50)).toBe('max(10px, 50.00%)');
      expect(helpers.formatFillWidth(99.87)).toBe('max(10px, 99.87%)');
    });

    test('rounds to 2 decimals', () => {
      expect(helpers.formatFillWidth(1 / 3)).toBe('max(10px, 0.33%)');
    });
  });

  describe('formatDisplayPercent', () => {
    test('returns 0 for zero/negative input', () => {
      expect(helpers.formatDisplayPercent(0)).toBe(0);
      expect(helpers.formatDisplayPercent(-1)).toBe(0);
    });

    test('floors any real progress to at least 1', () => {
      expect(helpers.formatDisplayPercent(0.14)).toBe(1);
      expect(helpers.formatDisplayPercent(0.49)).toBe(1);
      expect(helpers.formatDisplayPercent(1.0)).toBe(1);
    });

    test('rounds normally in the mid range', () => {
      expect(helpers.formatDisplayPercent(1.5)).toBe(2);
      expect(helpers.formatDisplayPercent(50.49)).toBe(50);
      expect(helpers.formatDisplayPercent(50.5)).toBe(51);
    });

    test('caps at 99 until percentage is exactly 100', () => {
      expect(helpers.formatDisplayPercent(99.4)).toBe(99);
      expect(helpers.formatDisplayPercent(99.5)).toBe(99);
      expect(helpers.formatDisplayPercent(99.99)).toBe(99);
    });

    test('returns 100 only when progress is truly complete', () => {
      expect(helpers.formatDisplayPercent(100)).toBe(100);
      expect(helpers.formatDisplayPercent(100.5)).toBe(100);
    });
  });
});
