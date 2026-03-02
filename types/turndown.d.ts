declare module "turndown" {
  interface TurndownRule {
    filter: string | string[] | ((node: HTMLElement) => boolean);
    replacement: (content: string, node: HTMLElement) => string;
  }

  interface TurndownOptions {
    headingStyle?: "setext" | "atx";
    codeBlockStyle?: "indented" | "fenced";
    linkStyle?: "inlined" | "referenced";
    bulletListMarker?: "-" | "+" | "*";
    strongDelimiter?: "**" | "__";
    emDelimiter?: "_" | "*";
  }

  export default class TurndownService {
    constructor(options?: TurndownOptions);
    turndown(html: string | HTMLElement): string;
    addRule(key: string, rule: TurndownRule): this;
    keep(filter: string | string[] | ((node: HTMLElement) => boolean)): this;
    remove(filter: string | string[] | ((node: HTMLElement) => boolean)): this;
  }
}
