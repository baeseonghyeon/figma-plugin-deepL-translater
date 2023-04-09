enum messageType {
    translate = "translate",
    setApiKey = "setApiKey",
    showFigmaErrorNotify = "showFigmaErrorNotify",
}

figma.showUI(__html__, {
    width: 380,
    height: 492,
});

const init = async () => {
    try {
        const API_KEY = (await figma.clientStorage.getAsync("API_KEY")) ?? "";
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

const translateHandler = async (messageData: any) => {
    const selectedLayers = figma.currentPage.selection;
    if (selectedLayers.length === 0) {
        showErrorMessage(
            "선택된 텍스트 레이어가 없습니다. 번역할 텍스트 레이어를 선택하세요."
        );
        return;
    }

    for (const layer of selectedLayers) {
        if (layer.type === "TEXT") {
            const originalText = layer.characters.trim();
            const translatedText = await fetchTranslation(
                originalText,
                messageData.target
            );

            if (translatedText) {
                await loadFonts(layer.fontName as FontName);

                if (messageData.isReplace) {
                    layer.characters = translatedText;
                } else {
                    appendSuggestText(layer, translatedText);
                }
            }
        }
    }
};

// Translate figma text using DeepL API
const fetchTranslation = async (
    text: string,
    target: string = "en"
): Promise<string | undefined> => {
    try {
        // Rapid DeepL API authentication key
        const RapidAPI_HOST = "deepl-translator.p.rapidapi.com";
        const RapidAPI_KEY =
            (await figma.clientStorage.getAsync("API_KEY")) ?? "";

        const response = await fetch(
            `https://deepl-translator.p.rapidapi.com/translate`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "X-RapidAPI-Key": RapidAPI_KEY,
                    "X-RapidAPI-Host": RapidAPI_HOST,
                },
                body: `{"text":"${text}","source":"auto","target":"${target}"}`,
            }
        );

        if (response.ok === true) {
            const result = await response.json();
            console.log(result);
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

const appendSuggestText = (textLayer: TextNode, translatedText: string) => {
    if (textLayer.parent) {
        const frame = figma.createFrame();
        const translatedSuggestText = figma.createText();

        frame.name = `en_${textLayer.characters}`;
        frame.layoutMode = "VERTICAL";
        frame.counterAxisSizingMode = "AUTO";
        frame.opacity = 0.6;

        frame.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];

        frame.x = textLayer.x;
        frame.y = textLayer.y + 50;

        translatedSuggestText.fontName = textLayer.fontName;
        translatedSuggestText.characters = translatedText;

        frame.appendChild(translatedSuggestText);
        textLayer.parent.appendChild(frame);
    }
};

init();
