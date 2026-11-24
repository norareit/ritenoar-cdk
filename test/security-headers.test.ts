import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { HeadersFrameOption, HeadersReferrerPolicy, ResponseHeadersPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { securityHeadersBehavior } from '../src';

describe('securityHeadersBehavior', () => {
  test('holds the four headers with their values, each overriding', () => {
    const { strictTransportSecurity, contentTypeOptions, frameOptions, referrerPolicy, ...others } =
      securityHeadersBehavior;

    expect(strictTransportSecurity).toBeDefined();
    expect(strictTransportSecurity!.accessControlMaxAge.toSeconds()).toBe(31536000);
    expect({ ...strictTransportSecurity, accessControlMaxAge: undefined }).toEqual({
      accessControlMaxAge: undefined,
      override: true,
    });
    expect(contentTypeOptions).toEqual({ override: true });
    expect(frameOptions).toEqual({ frameOption: HeadersFrameOption.SAMEORIGIN, override: true });
    expect(referrerPolicy).toEqual({
      referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
      override: true,
    });
    expect(others).toEqual({});
  });

  test('synthesizes into a response headers policy', () => {
    const stack = new Stack(new App(), 'Stack');
    new ResponseHeadersPolicy(stack, 'Policy', { securityHeadersBehavior });

    const policy = Template.fromStack(stack).findResources('AWS::CloudFront::ResponseHeadersPolicy');
    const config = Object.values(policy)[0].Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig;

    expect(config).toEqual({
      StrictTransportSecurity: { AccessControlMaxAgeSec: 31536000, Override: true },
      ContentTypeOptions: { Override: true },
      FrameOptions: { FrameOption: 'SAMEORIGIN', Override: true },
      ReferrerPolicy: { ReferrerPolicy: 'strict-origin-when-cross-origin', Override: true },
    });
  });
});
