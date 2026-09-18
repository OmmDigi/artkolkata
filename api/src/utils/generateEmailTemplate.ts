import path from "path";
import ejs from "ejs";
import logger from "./logger";
import { supportEmail } from "../services/email";

/**
 * Renders one of the templates/ files with ejs.
 *
 * Returns null when the render fails — a missing file, a template referencing a
 * variable the caller did not pass. It used to resolve the string "Error",
 * which sendEmail then cheerfully mailed to the customer as the entire body;
 * null forces the caller to decide, and sendEmail's decision is not to send.
 */
export const generateEmailTemplate = (
  templateData: ejs.Data,
  template_file_name: string
): Promise<string | null> => {
  let templatePath = path.join(process.cwd(), 'templates', template_file_name);
  
  const existTemplateDate = {
    ...templateData,
    hostname: process.env.HOST_NAME,
    companyName: process.env.COMPANY_NAME,
    supportEmail: supportEmail(),
  };

  return new Promise((resolve: (value: string | null) => void, reject) => {
    ejs.renderFile(templatePath, existTemplateDate, (err, html) => {
      if (err) {
        const logPayload = {
          message: "Error rendering EJS template:",
          stack: err,
        };
        logger.error(logPayload);
        return resolve(null);
      }
      resolve(html);
    });
  });
};
