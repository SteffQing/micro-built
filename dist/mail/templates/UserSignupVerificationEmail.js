"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = VerificationEmail;
const components_1 = require("@react-email/components");
const React = require("react");
function VerificationEmail({ code, userName = 'there' }) {
    return (React.createElement(components_1.Html, null,
        React.createElement(components_1.Head, null),
        React.createElement(components_1.Preview, null,
            "Your MicroBuilt verification code: ",
            code),
        React.createElement(components_1.Body, { style: styles.body },
            React.createElement(components_1.Container, { style: styles.container },
                React.createElement(components_1.Section, { style: styles.header },
                    React.createElement(components_1.Text, { style: styles.headerText }, "MICROBUILT")),
                React.createElement(components_1.Section, { style: styles.content },
                    React.createElement(components_1.Heading, { style: styles.heading }, "Email Verification"),
                    React.createElement(components_1.Text, { style: styles.paragraph },
                        "Hi ",
                        userName,
                        ","),
                    React.createElement(components_1.Text, { style: styles.paragraph }, "Welcome to MicroBuilt. Use the code below to verify your email and complete your account setup."),
                    React.createElement(components_1.Section, { style: styles.codeContainer },
                        React.createElement(components_1.Text, { style: styles.code }, code)),
                    React.createElement(components_1.Text, { style: styles.expiry }, "This code will expire in 10 minutes."),
                    React.createElement(components_1.Text, { style: styles.warning },
                        "If you did not request this, feel free to ignore this message or",
                        ' ',
                        React.createElement(components_1.Link, { style: styles.link, href: "https://www.microbuilt.app/support" }, "contact support"),
                        ".")),
                React.createElement(components_1.Section, { style: styles.footer },
                    React.createElement(components_1.Img, { src: "https://app.koopaa.fun/logo.png", alt: "MicroBuilt Logo", width: 150, height: 50, style: styles.logo }),
                    React.createElement(components_1.Text, { style: styles.footerText },
                        "\u00A9 ",
                        new Date().getFullYear(),
                        " MicroBuilt. All rights reserved."),
                    React.createElement(components_1.Text, { style: styles.footerText }, "This is an automated message, please do not reply."))))));
}
const styles = {
    body: {
        backgroundColor: '#f6f9fc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
        margin: 0,
        padding: 0,
    },
    container: {
        backgroundColor: '#ffffff',
        margin: '0 auto',
        padding: '20px 0',
        maxWidth: '600px',
    },
    header: {
        backgroundColor: '#0f172a',
        padding: '20px',
        textAlign: 'center',
    },
    headerText: {
        color: '#ffffff',
        fontSize: '24px',
        fontWeight: 'bold',
        margin: 0,
    },
    content: {
        padding: '30px 20px',
    },
    heading: {
        color: '#0f172a',
        fontSize: '24px',
        fontWeight: 'bold',
        margin: '0 0 20px',
        textAlign: 'center',
    },
    paragraph: {
        color: '#4a5568',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 20px',
    },
    codeContainer: {
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        margin: '30px 0',
        padding: '20px',
        textAlign: 'center',
    },
    code: {
        color: '#0f172a',
        fontFamily: 'monospace',
        fontSize: '36px',
        fontWeight: 'bold',
        letterSpacing: '8px',
        margin: 0,
    },
    expiry: {
        color: '#718096',
        fontSize: '14px',
        margin: '0 0 20px',
        textAlign: 'center',
    },
    warning: {
        color: '#718096',
        fontSize: '14px',
        fontStyle: 'italic',
        margin: '30px 0 0',
    },
    link: {
        color: '#3182ce',
        textDecoration: 'underline',
    },
    footer: {
        borderTop: '1px solid #e2e8f0',
        padding: '20px',
        textAlign: 'center',
    },
    logo: {
        margin: '0 auto 20px',
    },
    footerText: {
        color: '#a0aec0',
        fontSize: '12px',
        margin: '5px 0',
    },
};
//# sourceMappingURL=UserSignupVerificationEmail.js.map