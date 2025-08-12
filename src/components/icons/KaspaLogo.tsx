import React from "react";

const KaspaLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false" {...props}>
    <g fill="currentColor">
      <path d="M32 4l24 14v28L32 60 8 46V18L32 4zm0 6L14 20v24l18 10 18-10V20L32 10z"/>
      <path d="M22 40l8-8-8-8h8l8 8-8 8h-8z"/>
    </g>
  </svg>
);

export default KaspaLogo;
