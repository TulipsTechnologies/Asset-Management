/**
 * THE row-actions trigger — the three-dot square every table row uses, extracted from the
 * Assets page so it is defined exactly once. Fifteen-odd pages each hand-rolling this div
 * is how the design drifted apart in the first place.
 */
const RowKebab = () => (
  <div className="inline-flex size-8 items-center justify-center rounded-lg bg-white/80 transition-colors hover:bg-hoverColor hover:text-primarycolor">
    <i className="icon icon-elipsis-v text-sm"></i>
  </div>
);

export default RowKebab;
