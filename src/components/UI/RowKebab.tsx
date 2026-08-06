/**
 * THE row-actions trigger — the three-dot square every table row uses, extracted from the
 * Assets page so it is defined exactly once. Fifteen-odd pages each hand-rolling this div
 * is how the design drifted apart in the first place.
 */
const RowKebab = () => (
  <div className="bg-white/80 px-1.5 py-2 rounded-sm hover:bg-primarycolor hover:text-white">
    <i className="icon icon-elipsis-v text-sm"></i>
  </div>
);

export default RowKebab;
