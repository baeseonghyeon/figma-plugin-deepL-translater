enum messageType {
    translate = "translate",
    setApiKey = "setApiKey",
    showFigmaErrorNotify = "showFigmaErrorNotify",
}

let API_KEY: string;
let API_HOST: string = "deepl-translator.p.rapidapi.com";
let hasNotTextLayer: boolean = true;

figma.showUI(__html__, {
    width: 380,
    height: 492,
});

const init = async () => {
    try {
        API_KEY = (await figma.clientStorage.getAsync("API_KEY")) ?? "";
        figma.ui.postMessage({ type: "send-apiKey", payload: API_KEY });
    } catch (err) {
        console.log(err);
    }
};

figma.ui.onmessage = async (msg) => {
    if (msg.type === messageType.translate) {
        translateHandler(msg);
    }

    if (msg.type === messageType.setApiKey) {
        setApiKey(msg.apiKey);
    }

    if (msg.type === messageType.showFigmaErrorNotify) {
        showErrorMessage(msg.message);
    }
};

const setApiKey = async (apiKey: string) => {
    try {
        figma.notify("API KEY가 저장되었습니다.");
        await figma.clientStorage.setAsync("API_KEY", apiKey);
    } catch (err) {
        console.log(err);
        showErrorMessage("API KEY 저장에 문제가 있습니다.");
    }
};

const showErrorMessage = (message: string) => {
    figma.notify(message, { error: true });
};

const traverseNode = async (node: SceneNode, messageData: any) => {
    if ("children" in node && node.visible) {
        for (const childNode of node.children) {
            traverseNode(childNode, messageData);
        }
    }

    if (node.type === "TEXT" && node.visible) {
        await loadFonts(node.fontName as FontName);
        const originalText = node.characters.split("\n").join("");

        const translatedText = await fetchTranslation(
            originalText,
            messageData.target
        );

        if (translatedText) {
            if (messageData.isReplace) {
                node.characters = translatedText;
            } else {
                appendSuggestText(node, translatedText, messageData.target);
            }
        }

        if (hasNotTextLayer) {
            hasNotTextLayer = false;
        }
    }
};

const translateHandler = async (messageData: any) => {
    const selectedLayers = figma.currentPage.selection;

    for (const selectedLayer of selectedLayers) {
        await traverseNode(selectedLayer, messageData);
    }

    if (hasNotTextLayer) {
        showErrorMessage(
            "선택된 텍스트 레이어가 없습니다. 번역할 텍스트 레이어를 선택하세요."
        );
        return;
    }
};

// Translate figma text using DeepL API
const fetchTranslation = async (
    text: string,
    target: string = "en"
): Promise<string | undefined> => {
    try {
        const response = await fetch(
            `https://deepl-translator.p.rapidapi.com/translate`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "X-RapidAPI-Key": API_KEY,
                    "X-RapidAPI-Host": API_HOST,
                },
                body: `{"text":"${text}","source":"auto","target":"${target}"}`,
            }
        );

        if (response.ok === true) {
            const result = await response.json();
            return result.text;
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        showErrorMessage(`API 요청에 문제가 있습니다.\n(${error})`);
    }
};

const loadFonts = async (fontName: FontName) => {
    await figma.loadFontAsync({ family: fontName.family, style: "Regular" });
    await figma.loadFontAsync({ family: fontName.family, style: "Medium" });
    await figma.loadFontAsync({ family: fontName.family, style: "Bold" });
};

const appendSuggestText = (
    textLayer: TextNode,
    translatedText: string,
    target: string
) => {
    const frame = figma.createFrame();
    const translatedSuggestText = figma.createText();

    frame.name = `${target}_${textLayer.name}(${textLayer.characters})`;
    frame.layoutMode = "VERTICAL";
    frame.counterAxisSizingMode = "AUTO";
    frame.opacity = 0.8;
    frame.verticalPadding = 10;
    frame.horizontalPadding = 10;
    frame.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];

    translatedSuggestText.fontName = textLayer.fontName;
    translatedSuggestText.characters = translatedText;

    frame.appendChild(translatedSuggestText);

    if (frame.width > 500) {
        frame.counterAxisSizingMode = "FIXED";
        frame.resizeWithoutConstraints(500, frame.height);
        translatedSuggestText.resizeWithoutConstraints(
            frame.width - 20,
            translatedSuggestText.height
        );
    }

    frame.x = textLayer.absoluteTransform[0][2] - frame.width - 100;
    frame.y = textLayer.absoluteTransform[1][2];
};

init();
