import { describe, expect, test } from 'vitest';
import { stillSource } from './banner-png';

describe('stillSource', () => {
  test('the popup still is the close-up, not the copy inside the small monitor', () => {
    document.body.innerHTML = `
      <div class="preview-card">
        <div class="popup-closeup">
          <div class="preview-stage"><div class="preview" id="close"><div class="wrapper"></div></div></div>
        </div>
        <div class="obs-monitor">
          <div class="preview-stage"><div class="preview" id="monitor"><div class="wrapper"></div></div></div>
        </div>
      </div>`;
    expect(stillSource()?.id).toBe('close');
  });

  test('a normal banner uses the preview card', () => {
    document.body.innerHTML = `
      <div class="preview-card">
        <div class="preview-stage"><div class="preview" id="solo"><div class="wrapper"></div></div></div>
      </div>`;
    expect(stillSource()?.id).toBe('solo');
  });
});
