import {RecaptchaEnterpriseServiceClient} from '@google-cloud/recaptcha-enterprise';

/**
 * Create an assessment to analyze the risk of a UI action.
 *
 * projectID: Your Google Cloud Project ID.
 * recaptchaSiteKey: The reCAPTCHA key associated with the site/app
 * token: The generated token obtained from the client.
 * recaptchaAction: Action name corresponding to the token.
 */
export async function createAssessment({
                                    // TODO: Replace the token and reCAPTCHA action variables before running the sample.
                                    projectID = "tyler-truong-demos",
                                    recaptchaKey = "6LewlvgtAAAAAMEpxjpOtWHFYv9ahixufjudlQpt",
                                    token = "action-token",
                                    recaptchaAction = "action-name",
                                }) {
    // Create the reCAPTCHA client.
    // TODO: Cache the client generation code (recommended) or call client.close() before exiting the method.
    const client = new RecaptchaEnterpriseServiceClient();
    const projectPath = client.projectPath(projectID);

    // Build the assessment request.
    const request = ({
        assessment: {
            event: {
                token: token,
                siteKey: recaptchaKey,
            },
        },
        parent: projectPath,
    });

    const [ response ] = await client.createAssessment(request);

    // Check if the token is valid.
    // @ts-ignore
    if (!response.tokenProperties.valid) {
        // @ts-ignore
        console.log(`The CreateAssessment call failed because the token was: ${response.tokenProperties.invalidReason}`);
        return null;
    }

    // Check if the expected action was executed.
    // The `action` property is set by user client in the grecaptcha.enterprise.execute() method.
    // @ts-ignore
    if (response.tokenProperties.action === recaptchaAction) {
        // Get the risk score and the reason(s).
        // For more information on interpreting the assessment, see:
        // https://cloud.google.com/recaptcha/docs/interpret-assessment
        // @ts-ignore
        console.log(`The reCAPTCHA score is: ${response.riskAnalysis.score}`);
        // @ts-ignore
        response.riskAnalysis.reasons.forEach((reason) => {
            console.log(reason);
        });

        // @ts-ignore
        return response.riskAnalysis.score;
    } else {
        console.log("The action attribute in your reCAPTCHA tag does not match the action you are expecting to score");
        return null;
    }
}
