import path from "path";
import ejs from "ejs";
import logger from "./logger";

export const generateEmailTemplate = (
  templateData: ejs.Data,
  template_file_name: string
): Promise<string> => {
  let templatePath = path.join(process.cwd(), 'templates', template_file_name);
  
  const existTemplateDate = {
    ...templateData,
    hostname: process.env.HOST_NAME,
  };

  return new Promise((resolve: (value: string) => void, reject) => {
    ejs.renderFile(templatePath, existTemplateDate, (err, html) => {
      if (err) {
        const logPayload = {
          message: "Error rendering EJS template:",
          stack: err,
        };
        logger.error(logPayload);
        return resolve("Error");
        // reject("Error rendering EJS template:" + err);
      }
      resolve(html);
    });
  });
};
