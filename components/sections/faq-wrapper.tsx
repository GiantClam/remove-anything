import { getTranslations } from "next-intl/server";
import FAQ from "./faq";

export default async function FAQWrapper() {
  const t = await getTranslations({ namespace: "IndexPage.faq" });

  const faqs = [
    {
      question: t("q1.question"),
      answer: t("q1.answer"),
    },
    {
      question: t("q2.question"),
      answer: t("q2.answer"),
    },
    {
      question: t("q3.question"),
      answer: t("q3.answer"),
    },
    {
      question: t("q4.question"),
      answer: t("q4.answer"),
    },
    {
      question: t("q5.question"),
      answer: t("q5.answer"),
    },
    {
      question: t("q6.question"),
      answer: t("q6.answer"),
    },
  ];

  return (
    <section className="bg-gray-50 py-16 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">{t("title")}</h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            {t("description")}
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg bg-white shadow-sm dark:bg-gray-800">
            <FAQ faqs={faqs} />
          </div>
        </div>
      </div>
    </section>
  );
} 