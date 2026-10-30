type BrandWordmarkProps = {
  className?: string;
};

/** Nombre institucional: una sola I, con el 2 en lugar del punto. */
export function BrandWordmark({ className = '' }: BrandWordmarkProps) {
  return (
    <span
      aria-label="INICIA"
      className={`inline-flex items-end whitespace-nowrap pt-[0.35em] font-extrabold leading-none tracking-[-0.055em] ${className}`}
    >
      <span aria-hidden="true" className="relative inline-block">
        I
        <span className="absolute -top-[0.72em] left-[0.08em] text-[0.42em] leading-none tracking-normal">
          2
        </span>
      </span>
      <span aria-hidden="true">NICIA</span>
    </span>
  );
}
