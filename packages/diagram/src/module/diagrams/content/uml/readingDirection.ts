import { fun, id, stringType } from "@hylimo/core";
import { SCOPE } from "../../../base/dslModule.js";
import { ContentModule } from "../contentModule.js";

/**
 * Module providing the reading direction helper functions
 */
export const readingDirectionModule = ContentModule.create(
    "uml/readingDirection",
    [],
    [],
    [
        id(SCOPE).assignField(
            "readingLeft",
            fun(
                `
                    list(span(text = "\\u25c0", class = list("direction-triangle")), span(text = it))
                `,
                {
                    docs: "Can be used to create a label with an arrow pointing to the right. Typically used for labels on associations to indicate that the association should be read from right to left.",
                    params: [[0, "the text of the label", stringType]],
                    returns: "A list of spans, containing the arrow and the text"
                }
            )
        ),
        id(SCOPE).assignField(
            "readingRight",
            fun(
                `
                    list(span(text = it), span(text = "\\u25b6", class = list("direction-triangle")))
                `,
                {
                    docs: "Can be used to create a label with an arrow pointing to the left. Typically used for labels on associations to indicate the the reading direction from left to right.",
                    params: [[0, "the text of the label", stringType]],
                    returns: "A list of spans, containing the arrow and the text"
                }
            )
        ),
        id(SCOPE).assignField(
            "readingUp",
            fun(
                `
                    list(span(text = it), span(text = "\\u25b2", class = list("direction-triangle")))
                `,
                {
                    docs: "Can be used to create a label with an arrow pointing to the top. Typically used for labels on associations to indicate the the reading direction from bottom to top.",
                    params: [[0, "the text of the label", stringType]],
                    returns: "A list of spans, containing the arrow and the text"
                }
            )
        ),
        id(SCOPE).assignField(
            "readingDown",
            fun(
                `
                    list(span(text = it), span(text = "\\u25bc", class = list("direction-triangle")))
                `,
                {
                    docs: "Can be used to create a label with an arrow pointing to the bottom. Typically used for labels on associations to indicate the the reading direction from top to bottom.",
                    params: [[0, "the text of the label", stringType]],
                    returns: "A list of spans, containing the arrow and the text"
                }
            )
        ),
        `
            scope.styles {
                type("text") {
                    cls("direction-triangle") {
                        fontFamily = "Source Code Pro"
                        fontSize = 20
                    }
                }
            }
        `
    ]
);
