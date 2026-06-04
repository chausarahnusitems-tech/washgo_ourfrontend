import { Icon } from "../ui/Icon.jsx";

export function MapPreview({ large = false }) {
  return (
    <div className={`map-preview relative overflow-hidden ${large ? "h-[356px] rounded-none border-0" : "h-[198px] rounded-[18px] border border-[#dfe9e9]"}`}>
      <span className="map-road road-a" />
      <span className="map-road road-b" />
      <span className="map-road road-c" />
      <span className="absolute left-3 top-3 text-sm font-black text-ink/60">Thảo Điền</span>
      <span className="absolute right-3 top-10 text-sm font-black text-ink/60">Bình Thạnh</span>
      <span className="absolute bottom-3 left-3 text-sm font-black text-ink/60">An Khánh</span>
      <span className="absolute left-[48%] top-[39%] grid h-14 w-14 place-items-center rounded-full border-[8px] border-cyan-500/20 bg-cyan-500 text-white shadow-lg">
        <Icon name="MapPin" className="h-5 w-5" />
      </span>
      {[
        ["left-[24%] top-[55%]"],
        ["left-[70%] top-[48%]"],
        ["left-[36%] top-[72%]"]
      ].map(([position]) => (
        <span
          key={position}
          className={`absolute ${position} grid h-9 w-9 place-items-center rounded-full border-[3px] border-white bg-wash-500 text-white shadow-lg`}
        >
          <Icon name="Car" className="h-4 w-4" />
        </span>
      ))}
    </div>
  );
}
