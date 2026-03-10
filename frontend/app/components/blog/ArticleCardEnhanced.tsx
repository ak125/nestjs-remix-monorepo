import { Link } from "@remix-run/react";
import { Clock, Wrench, Eye, ArrowRight } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { ResponsiveImage } from "~/components/ui/ResponsiveImage";
import {
  type BlogArticle,
  getArticleUrl,
  getArticleImageUrl,
  getContentTypeLabel,
  getContentTypeBadgeColor,
  getDifficultyLabel,
  getDifficultyColor,
  formatTimeMinutes,
  formatViews,
  formatDate,
} from "./blog-helpers";

interface ArticleCardEnhancedProps {
  article: BlogArticle;
  showGammeLink?: boolean;
  compact?: boolean;
}

export function ArticleCardEnhanced({
  article,
  showGammeLink = true,
  compact = false,
}: ArticleCardEnhancedProps) {
  const url = getArticleUrl(article);
  const imageUrl = getArticleImageUrl(article.featuredImage);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md">
      {/* Image */}
      <Link
        to={url}
        className="relative aspect-[4/3] overflow-hidden bg-gray-50"
      >
        {imageUrl ? (
          <ResponsiveImage
            src={imageUrl}
            alt={article.title}
            className="h-full w-full object-contain p-3"
            loading="lazy"
            showPlaceholder
            aspectRatio="4/3"
            fallback="/images/pieces/default.png"
            widths={[160, 240, 320]}
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Wrench className="h-10 w-10 text-gray-400" />
          </div>
        )}
        {/* Content type badge (overlay) */}
        {article.contentType && (
          <span
            className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${getContentTypeBadgeColor(article.contentType)}`}
          >
            {getContentTypeLabel(article.contentType)}
          </span>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Meta badges row */}
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {article.difficulty != null && (
            <Badge
              variant="outline"
              className={`text-xs ${getDifficultyColor(article.difficulty)}`}
            >
              {getDifficultyLabel(article.difficulty)}
            </Badge>
          )}
          {article.timeMinutes != null && article.timeMinutes > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeMinutes(article.timeMinutes)}
            </span>
          )}
          {article.toolsCount != null && article.toolsCount > 0 && (
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {article.toolsCount} outils
            </span>
          )}
          {article.viewsCount > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatViews(article.viewsCount)}
            </span>
          )}
        </div>

        {/* Title */}
        <Link to={url}>
          <h3
            className={`font-semibold text-gray-900 group-hover:text-primary line-clamp-2 ${compact ? "text-sm" : "text-base"}`}
          >
            {article.title}
          </h3>
        </Link>

        {/* Excerpt */}
        {!compact && article.excerpt && (
          <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">
            {article.excerpt}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-gray-500">
          <span>{formatDate(article)}</span>

          {showGammeLink && article.primaryGammeSlug && (
            <Link
              to={`/pieces/${article.primaryGammeSlug}`}
              className="flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Voir pi&egrave;ces
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
