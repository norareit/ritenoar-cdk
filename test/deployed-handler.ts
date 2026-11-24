import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { runInNewContext } from 'vm';
import { CleanUrlsFunction, CleanUrlsFunctionProps } from '../src';

export interface FunctionEvent {
  request: {
    uri: string;
    headers: Record<string, { value: string }>;
    querystring: Record<string, { value: string; multiValue?: { value: string }[] }>;
  };
}

export interface Redirect {
  statusCode: number;
  statusDescription: string;
  headers: Record<string, { value: string }>;
}

export type Handler = (event: FunctionEvent) => Redirect | FunctionEvent['request'];

export interface DeployedFunction {
  Properties: { FunctionCode: string; FunctionConfig: { Runtime: string } };
}

/** The `AWS::CloudFront::Function` resource that a stack holding the construct synthesizes to. */
export function deployedFunction(props?: CleanUrlsFunctionProps): DeployedFunction {
  const stack = new Stack(new App(), 'Stack');
  new CleanUrlsFunction(stack, 'CleanUrls', props);
  const functions = Template.fromStack(stack).findResources('AWS::CloudFront::Function');
  return Object.values(functions)[0] as DeployedFunction;
}

/** The handler as it is deployed, evaluated from the function code of the template. */
export function deployedHandler(props?: CleanUrlsFunctionProps): Handler {
  const context: { handler?: Handler } = {};
  runInNewContext(`${deployedFunction(props).Properties.FunctionCode}\nthis.handler = handler;`, context);
  return context.handler as Handler;
}
