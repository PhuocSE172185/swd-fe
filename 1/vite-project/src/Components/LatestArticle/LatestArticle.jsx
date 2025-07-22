import "./LatestArticle.css";
import TitileTypeOne from "../../UI/TitileTypeOne/TitileTypeOne";
import { lettestArticleData } from "../../Data/Data";
import { Link } from "react-router-dom";
import { ImFacebook } from "react-icons/im";
import { FiInstagram } from "react-icons/fi";
import { RiTwitterXLine } from "react-icons/ri";
import { BsArrowRight } from "react-icons/bs";

export default function LatestArticle() {
  return (
    <section className="latesArticle">
      <div className="container latest-article-container ">
        <TitileTypeOne
          Title={"Latest Articles"}
          TitleTop={"Read our article"}
        />

        <div className="latest-article-content">
          {lettestArticleData.map(
            (
              {
                titlink,
                title,
                date,
                instLink,
                fbLink,
                twitalink,
                inspiration,
                image,
              },
              index
            ) => {
              return (
                <article className="lastest-article" key={index}>
                  <div className="article-image">
                    <img src={image} alt="" />
                  </div>
                  <div className="article-info">
                    <h5>{date}</h5>
                    <Link to={titlink}>
                      <h3>{title}</h3>
                    </Link>
                  </div>
                  <div className="latest-article-social">

                    <p>{inspiration}</p>
                    <div className="article-social">
                    <a href={fbLink}>
                      <ImFacebook />
                    </a>
                    <a href={instLink}>
                      <FiInstagram />
                    </a>
                    <a href={twitalink}>
                      <RiTwitterXLine />
                    </a>
                    </div>
                  </div>
                </article>
              );
            }
          )}
        </div>
        <Link to={"*"} className="btn btn border">
          <article>read all article</article>{" "}
        </Link>
      </div>
    </section>
  );
}
