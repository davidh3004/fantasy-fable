import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { LegalDoc } from "@/content/legal/types";

/**
 * Renders either legal document. They have the same shape — a title, a date, a
 * lead-in and a list of sections — so there is one component rather than two
 * near-identical pages that drift apart.
 */
export async function LegalDocView({
  doc,
  backHref,
}: {
  doc: LegalDoc;
  /** Where the back link goes, since these pages are reachable signed out. */
  backHref: string;
}) {
  const t = await getTranslations("legal");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>

      <h1 className="mt-4 font-heading text-3xl">{doc.title}</h1>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
        {t("updated", { date: doc.updated })}
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {doc.intro.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-7">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-heading text-lg">{section.heading}</h2>

            {section.paragraphs?.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-2.5 text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}

            {section.bullets && (
              <ul className="mt-2.5 flex flex-col gap-2">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2.5">
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70"
                      aria-hidden
                    />
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {bullet}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
