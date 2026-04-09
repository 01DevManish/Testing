import { generateTemplateDispatchPdf } from "./TemplatePdfService";

export const generateDispatchListPdf = async (list: any): Promise<void> => {
    // We now use the standardized template provided by the user
    await generateTemplateDispatchPdf(list);
};

