---
name: Dev Wrapped
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#bccbb9'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#869585'
  outline-variant: '#3d4a3d'
  surface-tint: '#53e076'
  primary: '#53e076'
  on-primary: '#003914'
  primary-container: '#1db954'
  on-primary-container: '#004118'
  inverse-primary: '#006e2d'
  secondary: '#e8b3ff'
  on-secondary: '#500074'
  secondary-container: '#a402e9'
  on-secondary-container: '#f9e0ff'
  tertiary: '#ffb1c1'
  on-tertiary: '#66002a'
  tertiary-container: '#ff7297'
  on-tertiary-container: '#730030'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#72fe8f'
  primary-fixed-dim: '#53e076'
  on-primary-fixed: '#002108'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#f6d9ff'
  secondary-fixed-dim: '#e8b3ff'
  on-secondary-fixed: '#310049'
  on-secondary-fixed-variant: '#7200a3'
  tertiary-fixed: '#ffd9df'
  tertiary-fixed-dim: '#ffb1c1'
  on-tertiary-fixed: '#3f0017'
  on-tertiary-fixed-variant: '#90003e'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-xl:
    fontFamily: Montserrat
    fontSize: 72px
    fontWeight: '900'
    lineHeight: 80px
    letterSpacing: -0.04em
  display-xl-mobile:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '900'
    lineHeight: 52px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.05em
  stats-number:
    fontFamily: Montserrat
    fontSize: 40px
    fontWeight: '900'
    lineHeight: 48px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1200px
  section-gap: 80px
  card-padding: 24px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The design system is a data-driven, celebratory aesthetic designed to frame a software engineer's career as a personalized "wrapped" experience. It targets a tech-savvy audience, blending the high-energy of a music festival with the precision of a developer's environment. 

The visual style is **High-Contrast / Bold** with heavy influences from **Glassmorphism**. It utilizes vibrant, neon accents against a deep, monochromatic base to create a sense of depth and excitement. The UI should evoke a sense of achievement, momentum, and modern digital craft. High-vibrancy gradients and glowing elements are used sparingly but purposefully to draw attention to key metrics and project successes.

## Colors
This design system operates exclusively in **dark mode**. The foundation is a deep "Spotify Black" (#121212), providing a high-contrast canvas for neon accents. 

- **Primary Green:** Reserved for primary actions, success states, and the most critical "hero" statistics.
- **Vibrant Purple & Neon Pink:** Used primarily for gradients, category distinctions (e.g., frontend vs. backend), and decorative "glow" elements.
- **Surface Hierarchy:** `background-surface` is the standard card background, while `background-surface-elevated` is used for interactive elements or items that need to sit higher in the visual stack.

## Typography
The typography strategy relies on the interplay between the geometric, heavy-weight **Montserrat** for headings and the clinical, functional **Inter** for body content.

- **Headlines:** Should be tight, bold, and impactful. Use `display-xl` for large yearly stats or introduction headlines.
- **Body:** Use `body-md` for general descriptions. Maintain generous line heights to ensure readability against the dark background.
- **Labels:** Use `label-bold` for tech stack chips and small metadata. These should always be uppercase with slight letter spacing to ensure they don't get lost in the dark UI.
- **Numeric Data:** Statistics are the core of this system. Use the `stats-number` style to make commits, years of experience, and contribution counts pop.

## Layout & Spacing
The layout follows a **fluid grid** model with a maximum container width of 1200px. It utilizes a 12-column system on desktop and a 4-column system on mobile.

- **Vertical Rhythm:** Sections are separated by large 80px gaps to mirror the airy, cinematic feel of Spotify's editorial layouts.
- **Content Density:** Maintain low density. Each card or statistical section should have significant breathing room to allow the neon gradients and typography to command attention.
- **Mobile Reflow:** On mobile, complex grid layouts should collapse into a single-column vertical stack. Large display type should scale down using the `-mobile` variants to prevent overflow.

## Elevation & Depth
This design system eschews traditional black drop shadows in favor of **Tonal Layers** and **Luminescent Glows**.

- **Surfaces:** Depth is created by shifting from `#121212` (floor) to `#181818` (card level). 
- **Glow Effects:** Critical cards (like "Featured Project") use a soft, 20-40px blur background-drop shadow using the primary or secondary accent colors at 30% opacity. This creates an "internal illumination" effect.
- **Glassmorphism:** Modals and navigation bars use a `backdrop-blur` of 12px with a `rgba(255, 255, 255, 0.05)` background and a 1px `rgba(255, 255, 255, 0.1)` border to simulate frosted glass.

## Shapes
The shape language is consistently **Rounded**, avoiding sharp corners to maintain a friendly, modern feel.

- **Standard Elements:** Buttons and input fields use a base radius of 8px.
- **Cards:** Main content cards use `rounded-lg` (16px) or `rounded-xl` (24px) for a more organic, containerized look.
- **Chips/Badges:** Technology tags and status badges always use a fully rounded "pill" shape (999px) to contrast against the more architectural card shapes.

## Components
- **Buttons:** Primary buttons are Solid Spotify Green with black text, 14px bold Montserrat. Secondary buttons are outlined with 1px white-opacity borders. All buttons have a subtle "lift" hover effect.
- **Cards:** The central component. Use `#181818` background. On hover, the background shifts to `#282828`. For high-priority cards, add a 1px stroke using a gradient of `Primary Green` to `Vibrant Purple`.
- **Chips/Badges:** Small, pill-shaped containers for tech stacks (e.g., "React", "TypeScript"). Use `#282828` background with `text-muted`.
- **Progress Bars:** Thin 4px tracks. The "filled" portion should use a linear gradient from `Vibrant Purple` to `Neon Pink`.
- **Stats Grid:** A component specifically for large numbers. Use `stats-number` for the value and `label-bold` for the description below it. Apply a glow effect to the number itself using its respective accent color.
- **Lists:** Clean, borderless rows with `16px` padding. Use a subtle `#FFFFFF10` separator or simply whitespace.