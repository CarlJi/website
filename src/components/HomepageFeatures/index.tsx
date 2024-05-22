import Translate from '@docusaurus/Translate';
import Heading from '@theme/Heading';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Kubernetes & Cloud Native',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
      云原生技术
      </>
    ),
  },
  {
    title: 'Quality Assurance',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
      质量保障
      </>
    ),
  },
  {
    title: 'Engineering efficiency',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
      工程效能
      </>
    ),
  },
  {
    title: 'Leadership',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
      技术领导力
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--3')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div>
          <Heading as="h2" className={clsx('margin-top--lg', 'text--center')}>
            <Translate>关注领域</Translate>
          </Heading>
        </div>
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
