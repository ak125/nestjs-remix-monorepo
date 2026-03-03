/**
 * ArticleActionsBar — Share + Bookmark actions for blog articles
 */

import { Share2, Bookmark } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trackShareArticle, trackBookmark } from "~/utils/analytics";

interface ArticleActionsBarProps {
  articleId: string;
  articleTitle: string;
  articleExcerpt?: string;
}

export function ArticleActionsBar({
  articleId,
  articleTitle,
  articleExcerpt,
}: ArticleActionsBarProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: articleTitle,
          text: articleExcerpt,
          url: window.location.href,
        })
        .then(() => {
          trackShareArticle("native", articleId, articleTitle);
        });
    } else {
      navigator.clipboard.writeText(window.location.href);
      trackShareArticle("copy", articleId, articleTitle);
      toast.success("Lien copié !", {
        description: "Le lien de l'article a été copié",
        duration: 2000,
      });
    }
  };

  const handleBookmark = () => {
    const newState = !isBookmarked;
    setIsBookmarked(newState);
    trackBookmark(articleId, newState ? "add" : "remove", articleTitle);
  };

  return (
    <>
      <hr className="my-4 border-gray-200" />
      <div className="flex items-center justify-between mt-8">
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Partager
          </button>
          <button
            onClick={handleBookmark}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Bookmark
              className={`w-4 h-4 ${isBookmarked ? "fill-current" : ""}`}
            />
            {isBookmarked ? "Enregistré" : "Enregistrer"}
          </button>
        </div>
      </div>
    </>
  );
}
