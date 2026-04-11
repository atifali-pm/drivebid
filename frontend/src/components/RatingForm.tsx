import { FormEvent, useState } from "react";

export default function RatingForm({
  label,
  onSubmit,
}: {
  label: string;
  onSubmit: (stars: number, comment: string) => void;
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(stars, comment);
    setComment("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-100 pt-3 mt-3 space-y-2"
    >
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            className={`text-2xl leading-none ${
              n <= stars ? "text-amber-400" : "text-slate-300"
            }`}
            aria-label={`${n} stars`}
          >
            ★
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <button
        type="submit"
        className="bg-brand hover:bg-brand-dark text-white text-sm px-4 py-1.5 rounded-md"
      >
        Submit rating
      </button>
    </form>
  );
}
