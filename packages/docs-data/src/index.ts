import type { LearningDocFull, AppDocEntryDTO } from "@hydyar/shared";
import { learningDocsJS, appEntriesJS } from "./data/javascript.js";
import { learningDocsPY, appEntriesPY } from "./data/python.js";
import { learningDocsHTML, appEntriesHTML } from "./data/html.js";
import { learningDocsCSS, appEntriesCSS } from "./data/css.js";
import { learningDocsSQL, appEntriesSQL } from "./data/sql.js";
import { learningDocsLUA, appEntriesLUA } from "./data/lua.js";
import {
  learningDocsTS, appEntriesTS,
  learningDocsC, appEntriesC,
  learningDocsCPP, appEntriesCPP,
  learningDocsPHP, appEntriesPHP,
} from "./data/bonus.js";

export const learningDocs: LearningDocFull[] = [
  ...learningDocsJS,
  ...learningDocsPY,
  ...learningDocsHTML,
  ...learningDocsCSS,
  ...learningDocsSQL,
  ...learningDocsLUA,
  ...learningDocsTS,
  ...learningDocsC,
  ...learningDocsCPP,
  ...learningDocsPHP,
];

export const appDocEntries: AppDocEntryDTO[] = [
  ...appEntriesJS,
  ...appEntriesPY,
  ...appEntriesHTML,
  ...appEntriesCSS,
  ...appEntriesSQL,
  ...appEntriesLUA,
  ...appEntriesTS,
  ...appEntriesC,
  ...appEntriesCPP,
  ...appEntriesPHP,
];
