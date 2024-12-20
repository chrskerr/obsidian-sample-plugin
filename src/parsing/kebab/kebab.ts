export function kebab<T = string>(input: string): T {
	return input
		.replaceAll(/#/g,"") //remove "#" which is not necessary
		.replaceAll(/\s/g,"") //remove all empty charactors which may not be allowed for a tag name
		.trim() as T;// trim the spaces
	/*
		.replaceAll(/\p{Lu}/gu, (match) => `-${match.toLowerCase()}`) // add a dash in front of upper case letters, and lower case them
		.replaceAll(/\p{Z}/gu, "-") // replace all whitespace with "-"
		.replaceAll(/[^\p{L}\p{N}-]/gu, "-") // replace all other chars with ""
		.replaceAll(/-+/g, "-") // collapse any consecutive "-" into a single "-"
		.replace(/^-/, "") // if starts with a "-", trim it
		.replace(/-$/, "") as T; // if ends with a "-", trim it
	*/
	//as TS and obsidian support Unicode, it seems that there is no needs for these replacement of charactors, which, breaks the nested tags.
}

// https://www.regular-expressions.info/unicode.html
