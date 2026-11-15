export function SatriaLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M20 3L6 8.5V19.2C6 27.6 12.1 35.1 20 37.5C27.9 35.1 34 27.6 34 19.2V8.5L20 3Z"
        fill="#0F1C36"
        stroke="#DC2626"
        strokeWidth="2"
      />
      <path
        d="M20 8.5L11.5 12V19.2C11.5 24.8 15.2 29.8 20 31.6C24.8 29.8 28.5 24.8 28.5 19.2V12L20 8.5Z"
        fill="#16284A"
        stroke="#334E7B"
        strokeWidth="1.2"
      />
      <path
        d="M15.5 20L18.8 23.3L25 16.5"
        stroke="#F8FAFC"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
