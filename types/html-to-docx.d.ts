declare module "html-to-docx" {
  interface DocumentOptions {
    table?: { row?: { cantSplit?: boolean } };
    font?: string;
    fontSize?: string | number;
  }
  function HTMLToDocx(
    htmlString: string,
    headerHTMLString?: string | null,
    documentOptions?: DocumentOptions,
    footerHTMLString?: string | null
  ): Promise<Buffer>;
  export default HTMLToDocx;
}
