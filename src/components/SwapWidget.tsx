import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/theme/ThemeProvider';

/*
 * A wrapper around the ChangeNow swap widget. This version introduces a few
 * improvements:
 *
 * 1. On mobile devices the embedded widget is given a larger height to better
 *    accommodate the UI. We accomplish this using responsive utility
 *    classes – by default (mobile) the iframe height is set to 300px, and
 *    on small screens and above (≥640px) it reverts to the original
 *    205px height. Feel free to adjust these values as needed.
 *
 * 2. The gradient border now matches the rest of the site – it uses a
 *    cyan→iris→pink gradient instead of the previous purple variant.
 *    This helps unify the look and feel across the home page.
 */
const SwapWidget: React.FC = () => {
  const { theme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Update the iframe source whenever the theme changes. We build the URL
  // dynamically to switch between dark and light modes. The widget parameters
  // mirror the official ChangeNOW snippet: primaryColor is set to our brand
  // colour (b692f6) and the exchange direction is from BTC to KAS. Note that
  // the toFiat parameter is intentionally kept as 'eth' based on the
  // provided snippet.
  useEffect(() => {
    if (iframeRef.current) {
      const isDark = theme === 'dark';
      const newSrc =
        `https://changenow.io/embeds/exchange-widget/v2/widget.html?FAQ=false` +
        `&amount=0.01&amountFiat=1500&backgroundColor=00000` +
        `&darkMode=${isDark}&from=btc&fromFiat=eur&horizontal=true` +
        `&isFiat=false&lang=en-US&link_id=26eb6983a7bef9&locales=true` +
        `&logo=false&primaryColor=b692f6&to=kas&toFiat=eth&toTheMoon=false`;
      iframeRef.current.src = newSrc;
    }
  }, [theme]);

  // Load the ChangeNOW stepper connector script once on mount. Script tags
  // rendered in JSX are not executed by React; therefore, we append the
  // script to the document here. When the component unmounts, remove
  // the script to prevent duplicate loads.
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://changenow.io/embeds/exchange-widget/v2/stepper-connector.js';
    script.defer = true;
    script.type = 'text/javascript';
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const isDark = theme === 'dark';
  const iframeSrc =
    `https://changenow.io/embeds/exchange-widget/v2/widget.html?FAQ=false` +
    `&amount=0.01&amountFiat=1500&backgroundColor=00000` +
    `&darkMode=${isDark}&from=btc&fromFiat=eur&horizontal=true` +
    `&isFiat=false&lang=en-US&link_id=26eb6983a7bef9&locales=true` +
    `&logo=false&primaryColor=b692f6&to=kas&toFiat=eth&toTheMoon=false`;

  return (
    <div className="relative rounded-xl p-[1px] bg-grad-primary shadow-[0_10px_40px_-12px_hsl(var(--brand-iris)/0.5)] transition-all duration-300">
      <div className="relative rounded-xl bg-background/70 backdrop-blur-md border border-border overflow-hidden">
        {/*
          Apply a subtle gradient overlay on top of the iframe. Because the
          ChangeNow widget itself only accepts a single primary colour, this
          overlay gives the impression of a cyan–iris–pink gradient across
          the widget while still allowing user interaction. The overlay
          is non-interactive (`pointer-events-none`) and semi-transparent.
        */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink opacity-20 pointer-events-none z-10" />
        <iframe
          ref={iframeRef}
          id="iframe-widget"
          src={iframeSrc}
          // Responsive height: taller on mobile (<768px) for better usability
          // Increase mobile height by an additional 40px to provide more space
          className="relative z-20 rounded-xl w-full border-none h-[358px] md:h-[205px]"
          style={{ border: 'none' }}
          title="Crypto Exchange Widget"
        />
      </div>
      {/* The ChangeNOW stepper-connector script is loaded via useEffect; see component code */}
    </div>
  );
};

export default SwapWidget;
