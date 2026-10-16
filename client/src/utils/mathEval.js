// Safe arithmetic evaluator. Replaces `new Function`/eval usage.
// Supports + - * / ( ) and decimal numbers via a shunting-yard parser.
export function evaluateExpression(input) {
    const tokens = String(input).match(/\d+(?:\.\d+)?|[+\-*/()]/g);
    if (!tokens || tokens.length === 0) {
        throw new Error('Invalid expression');
    }

    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const output = [];
    const operators = [];
    let prevType = null; // 'num' | 'op' | 'lparen'

    for (const token of tokens) {
        if (/^\d/.test(token)) {
            output.push(parseFloat(token));
            prevType = 'num';
        } else if (token === '(') {
            operators.push(token);
            prevType = 'lparen';
        } else if (token === ')') {
            while (operators.length && operators[operators.length - 1] !== '(') {
                output.push(operators.pop());
            }
            if (!operators.length) throw new Error('Mismatched parentheses');
            operators.pop();
            prevType = 'num';
        } else {
            // Unary +/- at the start of an expression or after another operator
            if ((token === '-' || token === '+') && (prevType === null || prevType === 'op' || prevType === 'lparen')) {
                output.push(0);
            }
            while (
                operators.length &&
                operators[operators.length - 1] !== '(' &&
                precedence[operators[operators.length - 1]] >= precedence[token]
            ) {
                output.push(operators.pop());
            }
            operators.push(token);
            prevType = 'op';
        }
    }

    while (operators.length) {
        const op = operators.pop();
        if (op === '(') throw new Error('Mismatched parentheses');
        output.push(op);
    }

    const stack = [];
    for (const token of output) {
        if (typeof token === 'number') {
            stack.push(token);
            continue;
        }
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) throw new Error('Invalid expression');
        switch (token) {
            case '+': stack.push(a + b); break;
            case '-': stack.push(a - b); break;
            case '*': stack.push(a * b); break;
            case '/': stack.push(a / b); break;
            default: throw new Error('Unknown operator');
        }
    }

    if (stack.length !== 1 || !Number.isFinite(stack[0])) {
        throw new Error('Invalid expression');
    }
    return stack[0];
}

export default evaluateExpression;
