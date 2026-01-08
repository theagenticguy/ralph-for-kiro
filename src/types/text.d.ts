/**
 * Type declarations for text file imports via Bun's text loader.
 * Allows importing .md files as strings with { type: "text" }.
 */
declare module "*.md" {
	const content: string;
	export default content;
}
