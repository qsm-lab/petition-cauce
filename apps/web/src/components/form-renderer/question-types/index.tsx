import type { Question, AnswerInput } from "@/lib/types";
import TextQuestion from "./TextQuestion";
import LongTextQuestion from "./LongTextQuestion";
import SingleChoice from "./SingleChoice";
import MultipleChoice from "./MultipleChoice";
import LikertScale from "./LikertScale";
import NpsScale from "./NpsScale";
import MatrixQuestion from "./MatrixQuestion";
import DateQuestion from "./DateQuestion";

export function renderQuestion(
  question: Question,
  currentAnswer: AnswerInput | undefined,
  onChange: (value: Partial<AnswerInput>) => void,
  extras?: { showIncompleteWarning?: boolean; showMinAlert?: boolean }
) {
  switch (question.type) {
    case "text":
    case "email":
      return <TextQuestion question={question} value={currentAnswer?.value_text} onChange={(v) => onChange({ value_text: v })} />;
    case "long_text":
      return <LongTextQuestion question={question} value={currentAnswer?.value_text} onChange={(v) => onChange({ value_text: v })} showMinAlert={extras?.showMinAlert} />;
    case "single_choice":
      return (
        <SingleChoice
          question={question}
          value={currentAnswer?.value_choice}
          otherText={currentAnswer?.value_other_text}
          onChange={onChange}
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoice
          question={question}
          values={currentAnswer?.value_choices || []}
          otherText={currentAnswer?.value_other_text}
          onChange={onChange}
        />
      );
    case "likert_scale":
      return <LikertScale question={question} value={currentAnswer?.value_number} onChange={(v) => onChange({ value_number: v })} />;
    case "nps":
      return <NpsScale question={question} value={currentAnswer?.value_number} onChange={(v) => onChange({ value_number: v })} />;
    case "matrix":
      return (
        <MatrixQuestion
          question={question}
          value={currentAnswer?.value_matrix}
          onChange={(v) => onChange({ value_matrix: v })}
          showIncompleteWarning={extras?.showIncompleteWarning}
        />
      );
    case "date":
      return <DateQuestion question={question} value={currentAnswer?.value_text} onChange={(v) => onChange({ value_text: v })} />;
    case "number":
      return <TextQuestion question={question} value={currentAnswer?.value_number?.toString()} onChange={(v) => onChange({ value_number: parseFloat(v) })} />;
    default:
      return null;
  }
}
