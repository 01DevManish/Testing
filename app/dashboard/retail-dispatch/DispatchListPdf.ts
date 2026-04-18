import { generateTemplateDispatchPdf } from "./TemplatePdfService";

export const generateDispatchListPdf = async (
    list: any,
    options?: { uploadToS3?: boolean; preferUploadedUrl?: boolean }
): Promise<void> => {
    // We now use the standardized template provided by the user
    await generateTemplateDispatchPdf(list, options);
};

