import { describe, it, expect } from 'vitest';
import * as reactBits from './index';

describe('@roomcommerce/ui react-bits suite', () => {
  it('exports all curated text animations', () => {
    expect(reactBits.BlurText).toBeDefined();
    expect(reactBits.ShinyText).toBeDefined();
    expect(reactBits.TrueFocus).toBeDefined();
    expect(reactBits.DecryptedText).toBeDefined();
    expect(reactBits.CountUp).toBeDefined();
    expect(reactBits.SplitText).toBeDefined();
  });

  it('exports interactive cards and components', () => {
    expect(reactBits.SpotlightCard).toBeDefined();
    expect(reactBits.TiltedCard).toBeDefined();
    expect(reactBits.DecayCard).toBeDefined();
  });

  it('exports background shaders and visual effects', () => {
    expect(reactBits.Aurora).toBeDefined();
    expect(reactBits.Particles).toBeDefined();
    expect(reactBits.Waves).toBeDefined();
  });

  it('exports motion micro-interactions', () => {
    expect(reactBits.AnimatedContent).toBeDefined();
    expect(reactBits.Magnet).toBeDefined();
    expect(reactBits.StarBorder).toBeDefined();
    expect(reactBits.ClickSpark).toBeDefined();
  });
});
