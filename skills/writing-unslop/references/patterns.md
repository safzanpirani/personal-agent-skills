# Slop patterns

Each entry names the pattern and the fix. A single hit can be coincidence. Several in one piece is a tell. Fix every hit in text meant to read as human.

## Rhetorical tics (the stagecraft tells)

| Pattern | Example | Fix |
|---|---|---|
| "No X, no Y" chain | "No sign-ups, no downloads, no hassle." | State the one fact that matters, or list plainly with "and". |
| "Did not X, did not Y" chain | "Did not flinch, did not blink, did not reach for the pen." | One verb. |
| "That's the whole …" / "is the whole …" / "is the entire …" / "the entire … is" | "That's the whole review." "Consistency is the entire game." | Say the point directly. |
| "Don't VERB it, VERB it" | "Don't call it a rewrite, call it a rescue." | Pick the noun you mean. |
| "Sit with that" | "Sit with that for a moment." | Delete. |
| "You already know" | "You already know the answer." | Delete or state the answer. |
| "Is real, and/not" | "The improvement is real, and it's not subtle." | Give the measurement. |
| "The punchline is" | | Delete the phrase, keep the content. |
| "Worth naming" | "That loss is worth naming." | Name it, drop the frame. |
| "That's not nothing" | | Give the number. |
| Echoing sentence skeletons | "The parser is a tiny state machine. The renderer is a tiny state machine." | Combine or vary. |
| Performative honesty | "I won't pretend", "let's be honest", "to be clear", "Honestly,", "Look," | Delete. |
| "That's the part …" | "That's the part a schedule can't capture." | State the detail. |
| "The only X I trust" | | State why, or delete. |
| "Don't take my word for it" | | Link the source instead. |
| "Turns out" | "It turns out that nobody reads the changelog." | "Nobody reads the changelog." |
| Dev-blog boilerplate | "fits in your head", "batteries included", "it just works", "zero config", "sane defaults" | Name the concrete property. |
| Stacked rhetorical questions | "Do I regret it? Do I miss the old importer?" | Answer, as statements. |
| Repeated sentence openers | "Maybe … Maybe … Maybe …" | Vary or merge. |
| Colon into a triple | "needed three things: a post, a video, and a page." | Fine in docs. In prose, list without the setup or use the natural count. |
| "Here's the twist / thing / catch / kicker / rub" | | Delete the phrase. |
| "X is dead" | "The old importer is dead." | "We removed the old importer." |
| "That's why X mattered" | | Say what X did. |
| Stranded auxiliary contrast | "The tool died; the data didn't." "Reading passed. Writing didn't." | Full second clause, or one sentence. |
| One-word drama sentence | "Stop." "Yet." "Period." | Delete. |
| Imperative sign-off | "Read the PDF." "Remember that." | Delete or give the link as a fact. |
| Trailing "Yet." or "For now." | "Not Navier-Stokes. Yet." | State the current status. |
| Aside asserting agreement | "I kind of agree with him." | Give the reason or drop it. |
| Arguing with no one | "This isn't mainly about speed." "A tempting approach would be …" | Drop the objection nobody raised; keep any real claim. |

## Wikipedia "Signs of AI writing"

| Pattern | Fix |
|---|---|
| AI vocabulary: delve, tapestry, meticulous, pivotal, intricate, interplay, underscore, garner, bolster, vibrant, bustling, multifaceted, seamless, ever-evolving, crucial, enduring, enhance, fostering, landscape (abstract), showcase, testament, additionally | Plain word. |
| "Not just X, but Y", "not only … but also", "it's not X, it's Y" | State Y. |
| "It is important to note", "worth noting", "should be noted", "worth pausing/asking" | Delete. |
| "Stands as / serves as / is a testament to" | Say what happened. |
| "Plays a crucial / pivotal / key role in" | Say what it does. |
| "Ever-evolving landscape", "in today's fast-paced world" | Delete. |
| "Experts argue", "critics note", "industry reports suggest" | Name the source or delete. |
| "Despite these challenges", "challenges remain", "remains to be seen", "time will tell" | Specific fact or delete. |
| Participle tails: ", highlighting / underscoring / showcasing / reflecting the …" | Delete or expand with a source. |
| Promotional boilerplate: nestled, in the heart of, rich heritage, hidden gem, boasts, breathtaking, stunning, must-visit, renowned, groundbreaking | Neutral description. |
| Chatbot leftovers: "as an AI language model", "as of my last update", "knowledge cutoff", oaicite, contentReference, turn0search, utm_source= | Delete. |
| Puffery: pivotal moment, setting the stage, indelible mark, deeply rooted | State the event. |
| Name-dropping outlets without content | Pick one and say what it said. |
| Fancy "is": serves as, stands as, boasts, features | is, has. |
| Rule of three forced onto ideas | Use the real count. |
| Synonym cycling (protagonist, main character, central figure) | Pick one word and repeat it. |
| False ranges: "from X to Y" where X and Y are not on a scale | List the items. |
| Vague association: "associated with", "in connection with" | State the relationship the source gives. |

## Style

- No em dashes, en dashes, or hyphens used as dashes. No parentheses as a dash substitute. End the sentence or use a comma.
- Colons only before a list or an example, never as a mid-sentence connector.
- No bold on every proper noun or acronym. A bold lead-in ending in a period followed by new detail is fine. A bold label with a colon restating the line is a tell.
- Sentence case headings. No emoji in headings or bullets.
- Straight quotes.

## Chat and document artifacts

- "I hope this helps", "Let me know if", "Of course!", "Certainly!", "Found the smoking gun!", "Great question", "You're absolutely right". Delete.
- "While specific details are limited …" Find the detail or delete.
- Heading repeated in the first sentence ("## Performance" then "Speed matters."). Let the heading do the work.
- Writing about the document instead of its subject: "This function was added to replace …", "The table below compares …". Describe the subject. Mention a convention only when the reader cannot see it.
- Re-explaining what the reader already knows. In a reply, lead with the decision and leave the diagnosis for later.

## Filler and hedging

- "In order to" becomes "To". "Due to the fact that" becomes "Because". "It is important to note that" is deleted.
- "could potentially possibly be argued that it might" becomes "may".
- "The future looks bright." Replace with a plan or a fact.

## Jargon nouns used as metaphor

Substrate, wedge, vector, locus, vantage, nexus, primitive (noun), harness (metaphor), surface (as in "API surface"), bedrock, scaffolding (metaphor), modality, paradigm, gold-plating, ratchet (metaphor), evacuate (for moving code), endgame, north star, flywheel. Use the concrete word: base, add, way, more than the job needs, the last phase, move out.

## Plain speech

- Say what it does, not how it feels. "SQL you can read" becomes "`.toSQL()` returns the exact string sent to the database". If a sentence could sit unchanged in another project's docs, it says nothing about this one. Cut it.
- One idea per sentence. Split anything the reader has to re-parse.
- Active voice. "The compiler validates queries", not "queries are validated". Passive only when the actor is unknown or irrelevant.
- Cut adverbs or fix the verb. "runs quickly" becomes "is fast" or the number. "significantly improves" becomes the measured delta.
- Plain word over fancy synonym: use, help, many, if.
