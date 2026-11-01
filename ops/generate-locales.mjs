import {readFileSync,writeFileSync} from 'node:fs';
const messages=JSON.parse(readFileSync(new URL('../web/app/messages.json',import.meta.url),'utf8'));
const quote=value=>JSON.stringify(value).replaceAll('$','\\$');
const pairs=Object.entries(messages).map(([de,en])=>`        ${quote(de)} to ${quote(en)}`).join(',\n');
const source=`package de.monopol.everything

// Generated from web/app/messages.json by ops/generate-locales.mjs.
object Localizer {
    private val english = mapOf(
${pairs}
    )
    private val german = english.entries.associate { it.value to it.key }
    fun text(source: String, language: String): String {
        val key = source.trim()
        return if (language == "de") german[key] ?: key else english[key] ?: key
    }
}
`;
writeFileSync(new URL('../android/app/src/main/java/de/monopol/everything/Localizer.kt',import.meta.url),source);
