import { generateTemplateDispatchPdf } from "./TemplatePdfService";
import { generateReactDispatchListPdf } from "./DispatchListPdfReact";
import { PackingList } from "./types";

export const generateDispatchListPdf = async (
    list: PackingList & Record<string, unknown>,
    options?: { uploadToS3?: boolean; preferUploadedUrl?: boolean }
): Promise<void> => {
    // Upload flow depends on template + S3 sync, so keep template for that path.
    if (options?.uploadToS3) {
        await generateTemplateDispatchPdf(list, options);
        return;
    }

    // For preview/download comparison, try the new React-PDF layout first.
    try {
        await generateReactDispatchListPdf(list);
    } catch (error) {
        console.warn("React PDF render failed. Falling back to template PDF.", error);
        await generateTemplateDispatchPdf(list, options);
    }
};

