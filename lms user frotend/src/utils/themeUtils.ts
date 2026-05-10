/**
 * Convert HEX color to HSL format
 */
function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  // Convert to degrees and percentages
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lPercent = Math.round(l * 100);
  
  return `${h} ${s}% ${lPercent}%`;
}

/**
 * Apply institute theme colors to CSS variables
 */
export function applyInstituteTheme(primaryColor?: string, secondaryColor?: string): void {
  const root = document.documentElement;
  
  if (primaryColor) {
    const primaryHSL = hexToHSL(primaryColor);
    root.style.setProperty('--primary', primaryHSL);
    root.style.setProperty('--sidebar-primary', primaryHSL);
    root.style.setProperty('--ring', primaryHSL);
    root.style.setProperty('--sidebar-ring', primaryHSL);
  }
  
  if (secondaryColor) {
    const secondaryHSL = hexToHSL(secondaryColor);
    root.style.setProperty('--secondary', secondaryHSL);
    root.style.setProperty('--accent', secondaryHSL);
    root.style.setProperty('--sidebar-accent', secondaryHSL);
  }
}

/**
 * Reset to default theme colors
 */
export function resetToDefaultTheme(): void {
  const root = document.documentElement;
  
  // Blue theme defaults
  root.style.setProperty('--primary', '217 91% 60%');
  root.style.setProperty('--secondary', '210 20% 92%');
  root.style.setProperty('--accent', '199 89% 48%');
  root.style.setProperty('--ring', '217 91% 60%');
  root.style.setProperty('--sidebar-primary', '217 91% 60%');
  root.style.setProperty('--sidebar-accent', '210 20% 96%');
  root.style.setProperty('--sidebar-ring', '217 91% 60%');
}
