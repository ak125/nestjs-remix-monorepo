/**
 * 📝 CONTENT BLOCK TEMPLATE
 *
 * Template pour contenu avec texte et image
 */

import React, { memo } from "react";
import { HtmlContent } from "../../seo/HtmlContent";

interface ContentBlockProps {
  title?: string;
  content: string;
  image?: string;
  imagePosition?: "left" | "right" | "top" | "bottom";
  sectionId: string;
  sectionName: string;
}

export const ContentBlock: React.FC<ContentBlockProps> = memo(
  function ContentBlock({ title, content, image, imagePosition = "right" }) {
    const isImageLeft = imagePosition === "left";
    const isImageVertical =
      imagePosition === "top" || imagePosition === "bottom";

    return (
      <div className="content-block">
        <div className="container mx-auto px-4 py-16">
          <div
            className={`grid gap-8 items-center ${
              isImageVertical
                ? "grid-cols-1"
                : `lg:grid-cols-2 ${isImageLeft ? "lg:grid-cols-[1fr,2fr]" : "lg:grid-cols-[2fr,1fr]"}`
            }`}
          >
            {/* Image en haut */}
            {imagePosition === "top" && image && (
              <div className="content-image">
                <img
                  src={image}
                  alt={title || "Contenu"}
                  className="w-full h-auto rounded-lg shadow-lg"
                />
              </div>
            )}

            {/* Image à gauche */}
            {isImageLeft && !isImageVertical && image && (
              <div className="content-image">
                <img
                  src={image}
                  alt={title || "Contenu"}
                  className="w-full h-auto rounded-lg shadow-lg"
                />
              </div>
            )}

            {/* Contenu textuel */}
            <div className="content-text">
              {title && (
                <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
              )}

              <HtmlContent
                html={content}
                className="prose prose-lg max-w-none text-gray-600"
              />
            </div>

            {/* Image à droite */}
            {!isImageLeft && !isImageVertical && image && (
              <div className="content-image">
                <img
                  src={image}
                  alt={title || "Contenu"}
                  className="w-full h-auto rounded-lg shadow-lg"
                />
              </div>
            )}

            {/* Image en bas */}
            {imagePosition === "bottom" && image && (
              <div className="content-image">
                <img
                  src={image}
                  alt={title || "Contenu"}
                  className="w-full h-auto rounded-lg shadow-lg"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
