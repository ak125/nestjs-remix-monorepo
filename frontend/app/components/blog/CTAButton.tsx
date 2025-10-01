import { ShoppingCart } from "lucide-react";

interface CTAButtonProps {
  anchor: string;
  link: string;
  className?: string;
}

export default function CTAButton({ anchor, link, className = "" }: CTAButtonProps) {
  return (
    <div className={`flex justify-center my-6 ${className}`}>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex flex-col items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
      >
        <div className="flex items-center gap-2">
          <ShoppingCart size={24} />
          <span className="text-lg">{anchor}</span>
        </div>
        <span className="text-sm uppercase tracking-wide">maintenant</span>
      </a>
    </div>
  );
}
