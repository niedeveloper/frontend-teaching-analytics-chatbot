import ReactD3Cloud from "react-d3-cloud";

export default function WordCloudSection({ wordCloudWords }) {
  return (
    <section className="rounded-2xl shadow-lg bg-white/90 border border-blue-100 px-2 md:px-6 py-6 flex flex-col items-center">
      <h2 className="text-indigo-700 font-semibold mb-4 text-lg md:text-xl">
        Teaching Style Word Cloud
      </h2>
      {wordCloudWords.length > 0 ? (
        <div className="w-full max-w-lg h-[240px]">
          <ReactD3Cloud
            data={wordCloudWords}
            fontSizeMapper={(word) => Math.log2(word.value + 1) * 25}
            width={400}
            height={220}
          />
        </div>
      ) : (
        <div className="text-gray-300 text-center">
          No conversation data yet.
        </div>
      )}
    </section>
  );
}
